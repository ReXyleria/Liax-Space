import { Socket, connect as connectTcp } from "node:net";
import { TLSSocket, connect as connectTls } from "node:tls";

export type SmtpEncryption = "none" | "ssl_tls" | "starttls";

export type SmtpClientConfig = {
  host: string;
  port: number;
  encryption: SmtpEncryption;
  user: string;
  pass: string;
};

export type SendMailInput = {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
};

type SmtpResponse = {
  code: number;
  text: string;
};

const smtpTimeoutMs = 15000;

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function dotStuff(value: string): string {
  return normalizeNewlines(value)
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function isAscii(value: string): boolean {
  return /^[\u0000-\u007f]*$/u.test(value);
}

function encodeHeader(value: string): string {
  return isAscii(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function escapeHeader(value: string): string {
  return value.replace(/[\r\n]+/gu, " ").trim();
}

function formatMailbox(name: string, address: string): string {
  const normalizedName = escapeHeader(name);

  if (!normalizedName) {
    return `<${address}>`;
  }

  return `${encodeHeader(normalizedName)} <${address}>`;
}

function extractAddress(value: string): string {
  const angleMatch = value.match(/<([^<>@\s]+@[^<>\s]+)>/u);

  if (angleMatch?.[1]) {
    return angleMatch[1];
  }

  return value.trim();
}

function buildMessage(input: SendMailInput): string {
  const fromAddress = extractAddress(input.from);
  const toAddress = extractAddress(input.to);
  const messageIdHost = fromAddress.split("@")[1] || "liax.local";
  const messageId = `${Date.now()}.${Math.random().toString(16).slice(2)}@${messageIdHost}`;
  const headers = [
    `From: ${formatMailbox(input.fromName, fromAddress)}`,
    `To: <${toAddress}>`,
    `Subject: ${encodeHeader(escapeHeader(input.subject))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit"
  ];

  return `${headers.join("\r\n")}\r\n\r\n${dotStuff(input.text)}`;
}

class SmtpSession {
  private buffer = "";
  private socket: Socket | TLSSocket;

  constructor(socket: Socket | TLSSocket) {
    this.socket = socket;
  }

  async readResponse(): Promise<SmtpResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("SMTP response timed out."));
      }, smtpTimeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
        this.socket.off("close", onClose);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onClose = () => {
        cleanup();
        reject(new Error("SMTP connection closed."));
      };

      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const response = this.shiftResponse();

        if (response) {
          cleanup();
          resolve(response);
        }
      };

      const response = this.shiftResponse();

      if (response) {
        cleanup();
        resolve(response);
        return;
      }

      this.socket.on("data", onData);
      this.socket.on("error", onError);
      this.socket.on("close", onClose);
    });
  }

  async sendCommand(command: string, expectedCodes: number | number[]): Promise<SmtpResponse> {
    this.socket.write(`${command}\r\n`);
    const response = await this.readResponse();
    const allowedCodes = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];

    if (!allowedCodes.includes(response.code)) {
      throw new Error(`SMTP command failed: ${command} -> ${response.text}`);
    }

    return response;
  }

  writeData(data: string): void {
    this.socket.write(data);
  }

  async upgradeToTls(host: string): Promise<void> {
    const previousSocket = this.socket;
    previousSocket.removeAllListeners("data");
    previousSocket.removeAllListeners("error");
    previousSocket.removeAllListeners("close");

    this.socket = await new Promise<TLSSocket>((resolve, reject) => {
      const secureSocket = connectTls({
        servername: host,
        socket: previousSocket
      }, () => resolve(secureSocket));

      secureSocket.once("error", reject);
    });
  }

  close(): void {
    this.socket.end();
  }

  destroy(): void {
    this.socket.destroy();
  }

  private shiftResponse(): SmtpResponse | null {
    const normalizedBuffer = this.buffer.replace(/\r/g, "");
    const lines = normalizedBuffer.split("\n");
    const responseLines: string[] = [];
    let consumedLength = 0;

    for (const line of lines) {
      if (!line) {
        consumedLength += 1;
        continue;
      }

      responseLines.push(line);
      consumedLength += line.length + 1;

      if (/^\d{3} /u.test(line)) {
        const code = Number(line.slice(0, 3));
        this.buffer = normalizedBuffer.slice(consumedLength).replace(/\n/g, "\r\n");

        return {
          code,
          text: responseLines.join("\n")
        };
      }
    }

    return null;
  }
}

function connectPlain(config: SmtpClientConfig): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connectTcp({
      host: config.host,
      port: config.port
    }, () => resolve(socket));

    socket.setTimeout(smtpTimeoutMs, () => {
      socket.destroy(new Error("SMTP connection timed out."));
    });
    socket.once("error", reject);
  });
}

function connectSecure(config: SmtpClientConfig): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = connectTls({
      host: config.host,
      port: config.port,
      servername: config.host
    }, () => resolve(socket));

    socket.setTimeout(smtpTimeoutMs, () => {
      socket.destroy(new Error("SMTP connection timed out."));
    });
    socket.once("error", reject);
  });
}

export async function sendSmtpMail(config: SmtpClientConfig, input: SendMailInput): Promise<string> {
  const socket = config.encryption === "ssl_tls" ? await connectSecure(config) : await connectPlain(config);
  const session = new SmtpSession(socket);
  const fromAddress = extractAddress(input.from);
  const toAddress = extractAddress(input.to);

  try {
    const greeting = await session.readResponse();

    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting failed: ${greeting.text}`);
    }

    await session.sendCommand(`EHLO ${config.host}`, 250);

    if (config.encryption === "starttls") {
      await session.sendCommand("STARTTLS", 220);
      await session.upgradeToTls(config.host);
      await session.sendCommand(`EHLO ${config.host}`, 250);
    }

    if (config.user || config.pass) {
      await session.sendCommand("AUTH LOGIN", 334);
      await session.sendCommand(Buffer.from(config.user, "utf8").toString("base64"), 334);
      await session.sendCommand(Buffer.from(config.pass, "utf8").toString("base64"), 235);
    }

    await session.sendCommand(`MAIL FROM:<${fromAddress}>`, 250);
    await session.sendCommand(`RCPT TO:<${toAddress}>`, [250, 251]);
    await session.sendCommand("DATA", 354);
    session.writeData(`${buildMessage(input)}\r\n.\r\n`);
    const response = await session.readResponse();

    if (response.code !== 250) {
      throw new Error(`SMTP DATA failed: ${response.text}`);
    }

    await session.sendCommand("QUIT", 221);
    session.close();

    return response.text;
  } catch (error) {
    session.destroy();
    throw error;
  }
}

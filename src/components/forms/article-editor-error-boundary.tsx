"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type State = {
  error: Error | null;
};

export class ArticleEditorErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[article-editor] client render failed", error, info.componentStack);
    void fetch("/api/console/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "article-editor",
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack
      })
    }).catch(() => undefined);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <Card className="border-destructive/30 bg-destructive/5 p-5">
        <div className="flex gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-destructive">文章编辑器初始化失败</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                已将浏览器端错误上报到服务端日志，标记为 [client-error] / article-editor。
              </p>
            </div>
            <pre className="max-h-40 overflow-auto rounded-md bg-background p-3 text-xs text-muted-foreground">
              {this.state.error.name}: {this.state.error.message}
            </pre>
            <Button type="button" variant="secondary" onClick={() => this.setState({ error: null })}>
              重试初始化
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}

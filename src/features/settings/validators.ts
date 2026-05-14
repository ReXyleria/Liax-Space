import { z } from "zod";

export const settingsUpdateSchema = z.record(z.string().max(10_000));

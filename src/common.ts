import { nanoid } from "nanoid";
import { TextDecoder } from "node:util";
import { z } from "zod";

export const INVALID_PAYLOAD = 4001;
export const BINARY_NOT_SUPPORTED = 4002;

const decoder = new TextDecoder();

export const incomingPayloadSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("ping"),
  }),
  z.object({
    t: z.literal("usage:mem"),
  }),
  z.object({
    t: z.literal("join"),
    room: z.string().min(1),
  }),
]);

export const outgoingPayloadSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("pong"),
  }),
  z.object({
    t: z.literal("usage:mem"),
    p: z.number(),
  }),
  z.object({
    t: z.literal("welcome"),
    id: z.string(),
  }),
  z.object({
    t: z.literal("joined"),
    room: z.string(),
  }),
]);

export type OutGoingPayload = z.infer<typeof outgoingPayloadSchema>;

export function generateId() {
  return `socket:${nanoid(24)}`;
}

export function out(data: OutGoingPayload) {
  return JSON.stringify(data);
}

export function getEventFromMessage(message: ArrayBuffer | string) {
  try {
    const string = typeof message === "string" ? message : decoder.decode(message);
    const json = JSON.parse(string);
    const event = incomingPayloadSchema.safeParse(json);
    if (!event.success) {
      return false;
    }
    return event.data;
  } catch (error) {
    console.error("[WS] Payload Error", error);
    return false;
  }
}

import { NextResponse } from "next/server";

export default function handler() {
  return NextResponse.json({ version: process.env.VERCEL_GIT_COMMIT_SHA });
}

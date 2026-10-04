import { NextRequest, NextResponse } from "next/server";
import { listPastDays } from "@/lib/app-state";
import { parseDeviceId } from "@/lib/device-id";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const deviceId = parseDeviceId(req.nextUrl.searchParams.get("device"));
    if (!deviceId) {
      return NextResponse.json({ error: "기기를 확인할 수 없습니다." }, { status: 400 });
    }
    const days = await listPastDays(deviceId);
    return NextResponse.json({ days });
  } catch (error) {
    const message = error instanceof Error ? error.message : "지난 단어를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

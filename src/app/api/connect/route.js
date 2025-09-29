import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json(
      { status: "error", message: "Username required" },
      { status: 400 }
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return NextResponse.json(
      { status: "error", message: "NEXT_PUBLIC_API_URL not set" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${apiUrl}/connect?username=${username}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 500 }
    );
  }
}

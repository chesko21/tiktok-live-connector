import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ status: "error", message: "Username required" }, { status: 400 });
  }

  try {
    // Forward request ke backend Node.js
    const res = await fetch(`http://localhost:3001/connect?username=${username}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 500 }
    );
  }
}

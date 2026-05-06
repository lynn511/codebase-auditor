import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const authHeader = request.headers.get('Authorization');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.redirect(new URL('/checkout?error=no_reference', request.url));
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (data.status && data.data.status === 'success') {
      // Payment was successful! You can update your database here to grant value.
      // Then redirect user to a success page
      return NextResponse.redirect(new URL('/payment-success', request.url));
    } else {
      // Payment failed
      return NextResponse.redirect(new URL('/checkout?error=verification_failed', request.url));
    }
  } catch (error) {
    return NextResponse.redirect(new URL('/checkout?error=server_error', request.url));
  }
}
import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { sendContractEmail } from '../../../lib/emailService';

// Disable Vercel authentication for this API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  runtime: 'nodejs',
  unstable_includeFiles: [],
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    const body = JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // 顧客情報を取得
        let customer: Stripe.Customer | null = null;
        if (paymentIntent.customer) {
          customer = await stripe.customers.retrieve(
            paymentIntent.customer as string
          ) as Stripe.Customer;
        }

        // 顧客にメールアドレスがある場合のみメール送信
        if (customer && customer.email) {
          await sendContractEmail({
            customerEmail: customer.email,
            customerName: customer.name || 'お客様',
            amount: paymentIntent.amount,
            paymentIntentId: paymentIntent.id,
            sessionId: paymentIntent.metadata?.session_id || 'N/A',
          });
        }
        break;
      }
      
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        
        // アドレスが新しく追加された場合の処理
        if (customer.email && customer.address) {
          console.log('Customer address updated:', {
            customerId: customer.id,
            email: customer.email,
            address: customer.address
          });
          
          // 最新の決済情報を取得してメール送信
          const paymentIntents = await stripe.paymentIntents.list({
            customer: customer.id,
            limit: 1,
          });

          if (paymentIntents.data.length > 0) {
            const latestPayment = paymentIntents.data[0];
            
            await sendContractEmail({
              customerEmail: customer.email,
              customerName: customer.name || 'お客様',
              amount: latestPayment.amount,
              paymentIntentId: latestPayment.id,
              sessionId: latestPayment.metadata?.session_id || 'N/A',
            });
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
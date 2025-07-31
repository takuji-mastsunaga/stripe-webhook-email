import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { sendContractEmail } from '../../../lib/emailService';

// Disable body parser to get raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
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

  // Get raw body for signature verification
  let buf = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    buf += chunk;
  });
  
  req.on('end', () => {
    try {
      event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err}`);
    }

    // Process the webhook event
    processWebhookEvent(event, res);
  });
}

async function processWebhookEvent(event: Stripe.Event, res: NextApiResponse) {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // メールアドレスを取得（顧客情報またはreceipt_emailから）
        let customerEmail: string | null = null;
        let customerName: string = 'お客様';
        
        if (paymentIntent.customer) {
          // 顧客情報を取得
          const customer = await stripe.customers.retrieve(
            paymentIntent.customer as string
          ) as Stripe.Customer;
          
          if (customer.email) {
            customerEmail = customer.email;
            customerName = customer.name || 'お客様';
          }
        } else if (paymentIntent.receipt_email) {
          // receipt_emailがある場合はそれを使用
          customerEmail = paymentIntent.receipt_email;
          customerName = 'お客様';
        }

        // メールアドレスがある場合のみメール送信
        if (customerEmail) {
          await sendContractEmail({
            customerEmail: customerEmail,
            customerName: customerName,
            amount: paymentIntent.amount,
            paymentIntentId: paymentIntent.id,
            sessionId: paymentIntent.metadata?.session_id || 'N/A',
          });
          
          console.log(`Email sent to: ${customerEmail} for payment: ${paymentIntent.id}`);
        } else {
          console.log(`No email address found for payment: ${paymentIntent.id}`);
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
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
          // 重複チェックが必要な金額を定義
          const standardPlanAmounts = [99080, 9800, 9500, 95080];
          const highPlanAmounts = [128880, 12300, 12000, 124880];
          const allPlanAmounts = [...standardPlanAmounts, ...highPlanAmounts];
          const needsDuplicateCheck = allPlanAmounts.includes(paymentIntent.amount);
          
          if (needsDuplicateCheck && paymentIntent.customer) {
            // 顧客のメタデータを確認
            const customer = await stripe.customers.retrieve(
              paymentIntent.customer as string
            ) as Stripe.Customer;
            
            // メタデータにform_sentフラグがある場合は送信しない
            if (customer.metadata?.form_sent === 'true') {
              console.log(`Form already sent to customer: ${customer.id} - Skipping email`);
            } else {
              // 初回送信の場合
              try {
                await sendContractEmail({
                  customerEmail: customerEmail,
                  customerName: customerName,
                  amount: paymentIntent.amount,
                  paymentIntentId: paymentIntent.id,
                  sessionId: paymentIntent.metadata?.session_id || paymentIntent.id,
                });
                
                console.log(`Email sent to: ${customerEmail} for payment: ${paymentIntent.id}`);
                
                // メタデータを更新してフラグを設定
                await stripe.customers.update(
                  paymentIntent.customer as string,
                  {
                    metadata: {
                      ...customer.metadata,
                      form_sent: 'true',
                      form_sent_date: new Date().toISOString(),
                      form_sent_payment_id: paymentIntent.id
                    }
                  }
                );
                console.log(`Customer metadata updated: form_sent flag set for ${customer.id}`);
              } catch (error) {
                console.error(`Email sending failed for payment: ${paymentIntent.id}`, error);
                // メール送信エラーでもwebhookは成功として返す
              }
            }
          } else {
            // 顧客IDがない場合（重複チェックが必要な金額だが顧客IDがない）
            console.log(`No customer ID found for duplicate check - Skipping email for: ${paymentIntent.id}`);
          }
        } else {
          console.log(`No email address found for payment: ${paymentIntent.id}`);
        }
        break;
      }
      
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        console.log(`Customer updated: ${customer.id} - ${customer.email}`);
        // customer.updatedイベントでは処理を行わない（payment_intent.succeededのみでメール送信）
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
import nodemailer from 'nodemailer';

interface EmailData {
  customerEmail: string;
  customerName: string;
  amount: number;
  paymentIntentId: string;
  sessionId: string;
}

function getFormUrlByAmount(amount: number): string | null {
  // 50円の場合のGoogleフォームURL
  if (amount === 5000) { // Stripeは cents単位なので50円 = 5000cents
    return 'https://docs.google.com/forms/d/e/1FAIpQLSdfGa5yztL7HNBMmACcpNe0YUDVRtIUj6CUaN_96wXAWCEfpA/viewform?usp=dialog';
  }
  
  // 65円の場合のGoogleフォームURL
  if (amount === 6500) { // 65円 = 6500cents
    return 'https://docs.google.com/forms/d/e/DIFFERENT_65_YEN_FORM_URL/viewform?usp=dialog';
  }
  
  // その他の金額の場合はnullを返す（メール送信しない）
  return null;
}

function formatAmount(amountInCents: number): string {
  const yenAmount = Math.round(amountInCents / 100);
  return `${yenAmount}円`;
}

function createEmailContent({
  customerName,
  amount,
  paymentIntentId,
  sessionId,
}: EmailData): { subject: string; html: string } | null {
  const formUrl = getFormUrlByAmount(amount);
  
  // サポート対象外の金額の場合はnullを返す
  if (!formUrl) {
    return null;
  }
  
  const formattedAmount = formatAmount(amount);

  const subject = '【みんなの税務顧問】ご契約及び決済完了のご連絡';
  
  const html = `
    <div style="font-family: 'Hiragino Sans', 'ヒラギノ角ゴシック', 'Yu Gothic', 'Meiryo', sans-serif; line-height: 1.6; color: #333;">
      <p>${customerName} 様</p>
      
      <p>この度は、「みんなの税務顧問」にご契約いただき、誠にありがとうございます。</p>
      <p>お客様からのご契約について、以下の通り決済が完了いたしました。</p>
      
      <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 5px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #495057;">📋 決済詳細情報</h3>
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 15px 0;">
        <p><strong>決済金額：</strong>${formattedAmount}</p>
        <p><strong>決済ID（PaymentIntent）：</strong>${paymentIntentId}</p>
        <p><strong>セッションID：</strong>${sessionId}</p>
        <p style="font-size: 14px; color: #6c757d;">※ 上記IDは決済の証明として大切に保管してください。</p>
      </div>
      
      <h3 style="color: #495057;">【今後のご対応について】</h3>
      
      <div style="margin: 20px 0;">
        <h4 style="color: #495057;">① 重要事項となるGoogleフォーム</h4>
        <p>以下フォームURLは必ずご入力ください。ご記入ができていないと権限の付与ができません。</p>
        <p><strong>※【Googleフォーム】 URL：</strong><br>
           <a href="${formUrl}" style="color: #007bff; text-decoration: none;">${formUrl}</a>
        </p>
      </div>
      
      <div style="margin: 20px 0;">
        <h4 style="color: #495057;">② ご契約者様専用の共有フォルダをご用意いたします</h4>
        <p>Googleフォーム入力後、Googleフォルダを自動で付与致します。</p>
        <p>こちらへ領収書やレシートを入れていただくようお願いいたします。</p>
        <p>詳細な手順を後日ご連絡いたしますので、今しばらくお待ちください。</p>
        <p style="color: #dc3545;">手順と違うものは、読み込みができない場合がございます。</p>
      </div>
      
      <div style="margin: 20px 0;">
        <h4 style="color: #495057;">③ チャットの付与について</h4>
        <p>付与に関しては、平日の日中（土日祝不可）となりますので、<br>
           それまでお時間頂戴いただきますが予めご了承ください。</p>
      </div>
      
      <p>準備が整い次第、ご登録のメールアドレス宛に別途ご案内をお送りしますので、<br>
         内容をご確認いただき、サービス開始に必要な情報のご入力をお願いいたします。</p>
      
      <hr style="border: none; border-top: 2px solid #dee2e6; margin: 30px 0;">
      
      <div style="text-align: center; color: #6c757d; font-size: 14px;">
        <p><strong>みんなの税務顧問 運営事務局</strong><br>
           minzei@solvis-group.com</p>
      </div>
    </div>
  `;

  return { subject, html };
}

export async function sendContractEmail(emailData: EmailData): Promise<void> {
  const emailContent = createEmailContent(emailData);
  
  // サポート対象外の金額の場合はメール送信しない
  if (!emailContent) {
    console.log(`Email not sent - unsupported amount: ${emailData.amount} cents (${Math.round(emailData.amount / 100)}円)`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const { subject, html } = emailContent;

  const mailOptions = {
    from: process.env.FROM_EMAIL || 'minzei@solvis-group.com',
    to: emailData.customerEmail,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${emailData.customerEmail} for ${Math.round(emailData.amount / 100)}円: ${info.messageId}`);
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}
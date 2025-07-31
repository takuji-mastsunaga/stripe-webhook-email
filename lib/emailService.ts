import nodemailer from 'nodemailer';

interface EmailData {
  customerEmail: string;
  customerName: string;
  amount: number;
  paymentIntentId: string;
  sessionId: string;
}

function getFormUrlByAmount(amount: number): string | null {
  console.log(`=== Amount Check ===`);
  console.log(`Received amount: ${amount} (type: ${typeof amount})`);
  console.log(`Amount in JPY: ¥${amount}`);
  
  // ¥141,768の場合（JPY通貨では141768として保存）
  if (amount === 141768) {
    console.log('Matched: 141768 JPY (¥141,768) - Using high value form');
    return 'https://docs.google.com/forms/d/e/1FAIpQLSdFO74YGRJbKUjTPpARAvx7f99L61RTUBcPVqtvLOA05FbvHw/viewform?usp=dialog';
  }
  
  // ¥108,988の場合（JPY通貨では108988として保存）
  if (amount === 108988) {
    console.log('Matched: 108988 JPY (¥108,988) - Using standard form');
    return 'https://docs.google.com/forms/d/e/1FAIpQLSdfGa5yztL7HNBMmACcpNe0YUDVRtIUj6CUaN_96wXAWCEfpA/viewform?usp=dialog';
  }
  
  console.log(`❌ Unsupported amount: ${amount} JPY - No email will be sent`);
  // その他の金額の場合はnullを返す（メール送信しない）
  return null;
}

function formatAmount(amountInJPY: number): string {
  return `¥${amountInJPY.toLocaleString()}`;
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
  
  // 決済金額の表示は削除

  const subject = '【みんなの税務顧問】ご契約及び決済完了のご連絡';
  
  const html = `${customerName}

この度は、「みんなの税務顧問」にご契約いただき、誠にありがとうございます。
お客様からのご契約について、以下の通り決済が完了いたしました。

メールの内容が省略されている場合がございます。
三点リーダー（...）で省略されている場合はそちらをクリックし全文を確認お願いいたします。

※Googleフォームにて情報提供のご依頼内容がありますので、必ず入力をお願いします


📋 決済詳細情報

決済ID（PaymentIntent）：${paymentIntentId}
※ 上記IDは決済の証明として大切に保管してください。


【今後のご対応について】

① 重要事項となるGoogleフォーム
以下フォームURLは必ずご入力ください。ご記入ができていないと権限の付与ができません。

【Googleフォーム】 URL：
${formUrl}

② ご契約者様専用の共有フォルダをご用意いたします
Googleフォーム入力後、Googleフォルダを自動で付与致します。
こちらへ領収書やレシートを入れていただくようお願いいたします。
詳細な手順を後日ご連絡いたしますので、今しばらくお待ちください。
手順と違うものは、読み込みができない場合がございます。

③ チャットの付与について
付与に関しては、平日の日中（土日祝不可）となりますので、
それまでお時間頂戴いただきますが予めご了承ください。

準備が整い次第、ご登録のメールアドレス宛に別途ご案内をお送りしますので、
内容をご確認いただき、サービス開始に必要な情報のご入力をお願いいたします。


みんなの税務顧問 運営事務局
minzei@solvis-group.com`;

  return { subject, html };
}

export async function sendContractEmail(emailData: EmailData): Promise<void> {
  const emailContent = createEmailContent(emailData);
  
  // サポート対象外の金額の場合はメール送信しない
  if (!emailContent) {
    console.log(`Email not sent - unsupported amount: ¥${emailData.amount}`);
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
    text: html, // プレーンテキストとして送信
    html: `<div style="color: black;">${html.replace(/\n/g, '<br>')}</div>`, // HTMLバージョンを黒文字で提供
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${emailData.customerEmail} for ¥${emailData.amount}: ${info.messageId}`);
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}
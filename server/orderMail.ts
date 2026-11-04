import nodemailer from 'nodemailer'
import { formatMoney } from '../src/lib/money.ts'
import { type ShopOrder } from '../src/data/sales.ts'

const shopInbox = 'hello@tescgsm.es'

function mailer() {
  const host = process.env.SMTP_HOST?.trim() ?? ''
  const user = process.env.SMTP_USER?.trim() ?? ''
  const pass = process.env.SMTP_PASS ?? ''
  if (!host || !user || !pass) return null
  const port = Number(process.env.SMTP_PORT ?? 587)
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

function moneyLine(label: string, amount: number) {
  return `${label}: ${formatMoney(amount)}`
}

function orderText(order: ShopOrder) {
  const lines = order.lines.map((line) => {
    const detail = line.detail.trim() ? ` (${line.detail.trim()})` : ''
    return `${line.name}${detail} × ${line.quantity} — ${formatMoney(line.price * line.quantity)}`
  })
  const address = [order.street, [order.postcode, order.city].filter(Boolean).join(' '), order.province, order.country]
    .map((part) => part.trim())
    .filter(Boolean)
  const amounts = [moneyLine('Total paid', order.totalPaid)]
  if (order.discount > 0) {
    amounts.unshift(moneyLine('Discount', -order.discount), moneyLine('Total', order.total))
  }
  return { lines, address, amounts }
}

export async function sendPlacedOrderEmail(order: ShopOrder) {
  const transport = mailer()
  if (!transport) {
    console.warn('Order email skipped. Set SMTP_HOST, SMTP_USER and SMTP_PASS.')
    return
  }
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || shopInbox
  const notify = process.env.ORDER_NOTIFY_EMAIL?.trim() || shopInbox
  const { lines, address, amounts } = orderText(order)
  const who = order.name.trim() || order.email
  const customerText = [
    `Hello ${who},`,
    '',
    `We have your order ${order.ref}.`,
    '',
    ...lines,
    '',
    ...amounts,
    '',
    'Delivery',
    ...(address.length ? address : ['No address was given.']),
    '',
    'Payment is not taken on this form. We confirm the order with you before anything is paid.',
    '',
    'tescgsm',
    shopInbox,
  ].join('\n')
  const shopText = [
    `New order ${order.ref}`,
    '',
    who,
    order.email,
    ...(order.phone.trim() ? [order.phone.trim()] : []),
    '',
    ...lines,
    '',
    ...amounts,
    '',
    'Delivery',
    ...(address.length ? address : ['No address was given.']),
  ].join('\n')

  await transport.sendMail({
    from,
    to: order.email,
    replyTo: notify,
    subject: `Order ${order.ref} received`,
    text: customerText,
  })
  await transport.sendMail({
    from,
    to: notify,
    replyTo: order.email,
    subject: `New order ${order.ref}`,
    text: shopText,
  })
}

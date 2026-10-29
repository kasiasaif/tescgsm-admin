import { type Product } from '../src/data/catalog.ts'

export class IntakeConfigError extends Error {}

type ModelPayload = {
  matches?: unknown
  unmatched?: unknown
}

export async function proposeIntakeMatches(
  note: string,
  catalog: Product[],
): Promise<{ proposed: unknown[]; unmatched: string[] }> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    throw new IntakeConfigError(
      'Add OPENAI_API_KEY to the admin .env. Matching is not run without the key.',
    )
  }

  const catalogForModel = catalog.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    model: product.model,
    spec: product.spec,
    category: product.category,
  }))

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Match messy price notes to existing catalog rows. Categories are Batteries and LCD only. Use only product ids from the catalog. Never invent a product. The only number taken from the note is the new price in EUR. Return JSON {"matches":[{"line":"fragment from the note","productId":number,"price":number}],"unmatched":["lines with no catalog product"]}.',
        },
        {
          role: 'user',
          content: `Catalog:\n${JSON.stringify(catalogForModel)}\n\nNote:\n${note}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error('The model could not match this note. Try again.')
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content ?? ''
  let payload: ModelPayload
  try {
    payload = JSON.parse(raw) as ModelPayload
  } catch {
    throw new Error('The model did not return usable matches.')
  }

  const proposed = Array.isArray(payload.matches) ? payload.matches : []
  const unmatched = Array.isArray(payload.unmatched)
    ? payload.unmatched.map((item) => String(item).trim()).filter(Boolean)
    : []
  return { proposed, unmatched }
}

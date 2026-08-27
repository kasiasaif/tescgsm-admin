type ComingSoonProps = {
  title: string
  body: string
}

export function ComingSoon({ title, body }: ComingSoonProps) {
  return (
    <section className="panel empty-panel">
      <h2>{title}</h2>
      <p className="muted">{body}</p>
    </section>
  )
}

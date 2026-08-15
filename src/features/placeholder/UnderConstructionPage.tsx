interface UnderConstructionPageProps {
  title: string;
}

export function UnderConstructionPage({ title }: UnderConstructionPageProps) {
  return (
    <section className="p-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Esta tela ainda está sendo construída.</p>
    </section>
  );
}

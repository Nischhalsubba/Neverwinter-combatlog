type InfoGridItem = {
  title: string;
  body: string;
};

type InfoGridProps = {
  items: InfoGridItem[];
};

export function InfoGrid({ items }: InfoGridProps) {
  return (
    <div className="info-grid">
      {items.map((item) => (
        <article className="panel info-card" key={item.title}>
          <h2>{item.title}</h2>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}


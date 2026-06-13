type Props = {
  phrase: string | null;
  hidden?: boolean;
};

export default function CoupleWorldSection({ phrase, hidden = false }: Props) {
  if (!phrase || hidden) return null;

  return (
    <header className="aiai-express-phrase-block aiai-couple-world-header">
      <h1 className="aiai-couple-phrase text-center leading-snug px-1">{phrase}</h1>
    </header>
  );
}

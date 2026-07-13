type IconProps = { name: string; className?: string };

/** public/icons/{name}.svg 를 렌더링하는 공용 아이콘. */
export function Icon({ name, className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/${name}.svg`} alt="" className={className} />;
}

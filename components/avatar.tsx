import Image from "next/image";

export function Avatar({
  name,
  photo,
  color = "sage",
  large = false,
}: {
  name: string;
  photo?: string;
  color?: string;
  large?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`avatar avatar-${color} ${large ? "avatar-large" : ""}`}>
      {photo ? (
        <Image
          src={photo}
          alt={`Foto de ${name}`}
          fill
          unoptimized
          sizes={large ? "96px" : "44px"}
          className="object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

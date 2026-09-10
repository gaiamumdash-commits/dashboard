import Image from "next/image";

export function LogoCafeDoMangue({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/logo-cafe-do-mangue.png"
      alt="Café do Mangue"
      width={size}
      height={size}
      className="rounded-md"
    />
  );
}

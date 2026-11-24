export const getInitials = ({
  name,
  count = 2,
}: {
  name: string;
  count?: number;
}) => {
  return name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, count)
    .join("")
    .toUpperCase();
};

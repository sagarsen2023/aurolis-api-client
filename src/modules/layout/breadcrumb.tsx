import { Link } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { breadCrumbAtom } from "@/context/breadcrumb-context";

function BreadCrumb() {
  const breadCrumb = useAtomValue(breadCrumbAtom);
  if (breadCrumb.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-2 text-[15px] text-mute">
        {breadCrumb.map((item, index) => {
          const isLast = index === breadCrumb.length - 1;
          return (
            <li
              key={`${index}-${item.link}`}
              className="flex min-w-0 items-center gap-2"
            >
              <span aria-hidden className="text-dim">
                /
              </span>
              {isLast ? (
                <span aria-current="page" className="truncate">
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.link}
                  className="truncate transition-colors hover:text-foreground"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default BreadCrumb;

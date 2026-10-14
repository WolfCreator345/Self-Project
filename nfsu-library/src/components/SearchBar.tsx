import { Icon } from "@/lib/icons";

export function SearchBar({
  defaultValue = "",
  id = "hero-search",
  category,
  sort,
  size = "lg",
}: {
  defaultValue?: string;
  id?: string;
  category?: string;
  sort?: string;
  size?: "lg" | "md";
}) {
  const big = size === "lg";
  return (
    <form action="/books" method="get" role="search" className="w-full">
      <label htmlFor={id} className="sr-only">
        Search the catalogue by title, author, ISBN or category
      </label>
      <div
        className={`flex items-center gap-2 rounded-full bg-white shadow-lift ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-navy ${
          big ? "p-2 pl-5" : "p-1.5 pl-4"
        }`}
      >
        <Icon name="search" size={big ? 22 : 20} className="shrink-0 text-ink-soft" />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder="Title, author, ISBN, subject"
          autoComplete="off"
          enterKeyHint="search"
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-soft/80 focus:outline-none focus-visible:outline-none ${
            big ? "min-h-12 text-base md:text-lg" : "min-h-11 text-base"
          }`}
        />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {sort ? <input type="hidden" name="sort" value={sort} /> : null}
        <button type="submit" className={`btn-primary shrink-0 ${big ? "min-h-12 px-4 sm:px-5 md:px-7" : "px-4 sm:px-5"}`}>
          Search
        </button>
      </div>
    </form>
  );
}

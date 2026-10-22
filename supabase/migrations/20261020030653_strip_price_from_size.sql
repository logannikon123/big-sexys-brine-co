-- Take the price out of each product's size label.
--
-- Before products had a price field, the price was typed at the end of the
-- size, e.g. "16oz (1/2QT) $15". Prices now live in price_cents, so this
-- drops a trailing " $15" or " $15.00" and leaves "16oz (1/2QT)".
--
-- Only labels that hold a dollar sign followed by a digit change. The site
-- already hides a trailing price when it shows the size, so pages look the
-- same before and after this runs.

update public.products
set size = regexp_replace(size, '\s*\$\d+(\.\d{1,2})?\s*$', '')
where size ~ '\$\d';

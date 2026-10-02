/** wrangler nhúng file .html vào Worker dạng chữ (xem "rules" trong wrangler.jsonc). */
declare module '*.html' {
  const html: string;
  export default html;
}

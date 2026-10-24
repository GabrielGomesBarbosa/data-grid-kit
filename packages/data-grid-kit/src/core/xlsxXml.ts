/** XML text helpers shared by the xlsx writer's parts. */

// characters XML 1.0 cannot carry (control characters, lone surrogates, U+FFFE/FFFF)
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
export const escapeXml = (s: string) => s.replace(ILLEGAL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

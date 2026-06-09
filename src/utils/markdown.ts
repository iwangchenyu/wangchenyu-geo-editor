export function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  });
  
  // Horizontal rules
  html = html.replace(/^[-*_]{3,}\s*$/gm, '<hr>');
  
  // Headings (must be before bold/italic)
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Unordered lists - group consecutive items
  html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (match: string) => {
    const items = match.trim().split('\n').map(line => 
      `<li>${line.replace(/^[-*+] /, '')}</li>`
    ).join('');
    return `<ul>${items}</ul>`;
  });
  
  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match: string) => {
    const items = match.trim().split('\n').map(line => 
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('');
    return `<ol>${items}</ol>`;
  });
  
  // Paragraphs: split by double newlines, wrap non-tag lines
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Skip if already a block element
    if (/^<(h[1-4]|ul|ol|pre|hr|blockquote|table|div)/.test(trimmed)) return trimmed;
    // Wrap remaining text in <p>
    const lines = trimmed.split('\n');
    return `<p>${lines.join('<br>')}</p>`;
  }).join('\n');
  
  return html;
}

export function copyRichText(html: string): Promise<void> {
  const blob = new Blob([html], { type: 'text/html' });
  const clipboardItem = new ClipboardItem({
    'text/html': blob,
    'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], { type: 'text/plain' }),
  });
  return navigator.clipboard.write([clipboardItem]);
}

filepath = r'app\(auth)\[workspaceSlug]\quotes\[id]\quote-builder.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()
old = '''          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            {quote.customer_name}
            {quote.job_name && <span className="text-slate-500 font-normal"> — {quote.job_name}</span>}
          </h1>'''
new = '''          <div className="mt-1">
            <QuoteNameEditor 
              quoteId={quote.id}
              customerName={quote.customer_name}
              jobName={quote.job_name}
            />
          </div>'''
content = content.replace(old, new) if old in content else exit('[ERROR]')
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('[DONE]')

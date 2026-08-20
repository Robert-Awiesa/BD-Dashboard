// Inline data-entry card: tinted header, white field body, and a separated
// action bar so the submit controls always read as part of the form rather
// than floating loose at the bottom of the page.
const FormCard = ({ title, description, onSubmit, footer, children, className = '' }) => {
  const body = (
    <>
      <div className="p-5 space-y-4">{children}</div>
      {footer && (
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-end items-center gap-2">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
        <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
    </div>
  );
};

export default FormCard;

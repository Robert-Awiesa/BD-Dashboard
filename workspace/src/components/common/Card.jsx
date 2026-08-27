const Card = ({ title, children, className = '', actionComponent }) => {
  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between ${className}`}>
      {title && (
        <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-100">
          <h3 className="text-base font-bold text-navy-950 tracking-tight">{title}</h3>
          {actionComponent && <div>{actionComponent}</div>}
        </div>
      )}
      <div className="flex-1 text-slate-600">
        {children}
      </div>
    </div>
  );
};

export default Card;
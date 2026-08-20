
const Card = ({ title, children, className = '', actionComponent }) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between ${className}`}>
      {title && (
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
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
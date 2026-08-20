
const Button = ({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  // Associates the button with a <form> by id. Needed whenever a submit button
  // sits outside its form — as it does in every Modal, where the footer is a
  // sibling of the scrolling body rather than a descendant of the form.
  form,
  title,
  className = ''
}) => {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-sm';
  
  const variants = {
    primary: 'bg-navy-700 hover:bg-navy-800 text-white disabled:bg-navy-200 disabled:text-slate-400',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
    danger: 'bg-red-700 hover:bg-red-800 text-white',
    success: 'bg-forest-600 hover:bg-forest-700 text-white',
  };

  return (
    <button
      type={type}
      form={form}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
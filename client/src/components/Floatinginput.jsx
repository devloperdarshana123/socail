
const FloatingInput = ({ label, name, type = "text", value, onChange, children }) => {
  return (
    <div className="relative">
      <input
        type={type}
        name={name}
        id={name}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="peer w-full h-14 border-2 border-gray-300 rounded-xl px-4 pt-4 pb-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
      />
      <label
        htmlFor={name}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 transition-all duration-200
          peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400
          peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-gray-600
          peer-not-placeholder-shown:top-2 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:text-gray-600
          pointer-events-none"
      >
        {label}
      </label>
      {children}
    </div>
  );
};

export default FloatingInput;
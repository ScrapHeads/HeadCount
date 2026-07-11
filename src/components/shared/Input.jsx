import { FORM_INPUT_CLASS_NAME } from '../../styles/classNames';

const Input = ({ className = '', label, type = 'text', value, onChange, ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-sm font-medium text-on-primary">{label}</label>}
    <input
      className={`${FORM_INPUT_CLASS_NAME} ${className}`}
      type={type}
      value={value}
      onChange={onChange}
      {...props}
    />
  </div>
);

export default Input;

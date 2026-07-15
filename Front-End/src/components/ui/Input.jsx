import React, { forwardRef } from 'react';
import './ui.css';

const Input = forwardRef(({ label, error, className = '', ...props }, ref) => {
  return (
    <div className={`input-wrapper ${className}`}>
      {label && <label className="input-label">{label}</label>}
      <input 
        ref={ref}
        className={`input-field ${error ? 'input-error' : ''}`} 
        {...props} 
      />
      {error && <span className="error-text">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

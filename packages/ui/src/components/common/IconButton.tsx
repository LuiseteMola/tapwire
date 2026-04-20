interface IconButtonProps {
  icon: string;
  title: string;
  onClick: () => void;
  className?: string;
}

export function IconButton({ icon, title, onClick, className = '' }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`cursor-pointer text-zinc-600 hover:text-zinc-300 transition-colors text-base leading-none ${className}`}
    >
      {icon}
    </button>
  );
}

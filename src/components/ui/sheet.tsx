import * as React from "react"

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: "top" | "right" | "bottom" | "left"
  children: React.ReactNode
}

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const Sheet = ({ open, onOpenChange, side = "right", children }: SheetProps) => {
  if (!open) return null

  const getSideStyle = () => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: "#ffffff",
      boxShadow: "0 8px 10px 1px rgba(0, 0, 0, 0.14), 0 3px 14px 2px rgba(0, 0, 0, 0.12), 0 5px 5px -3px rgba(0, 0, 0, 0.2)",
      zIndex: 51,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }

    if (side === "right") {
      return {
        ...baseStyle,
        right: 0,
        width: "320px",
        borderRadius: "0 8px 8px 0",
        animation: "slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }
    } else if (side === "left") {
      return {
        ...baseStyle,
        left: 0,
        width: "320px",
        borderRadius: "8px 0 0 8px",
        animation: "slideInLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }
    } else if (side === "top") {
      return {
        ...baseStyle,
        top: 0,
        width: "100%",
        height: "auto",
        borderRadius: "8px 8px 0 0",
        animation: "slideInTop 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }
    } else {
      return {
        ...baseStyle,
        bottom: 0,
        width: "100%",
        height: "auto",
        borderRadius: "0 0 8px 8px",
        animation: "slideInBottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }
    }
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          animation: "fadeIn 0.2s ease-out",
          borderRadius: "8px"
        }}
        onClick={() => onOpenChange(false)}
      />
      <div style={getSideStyle()}>
        {children}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideInTop {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideInBottom {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

const SheetContent = ({ children, ...props }: SheetContentProps) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "auto",
        ...props.style
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void
}

const SheetHeader = ({ children, onClose, ...props }: SheetHeaderProps) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        position: "relative",
        ...props.style
      }}
      {...props}
    >
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "40px",
            minHeight: "40px",
            borderRadius: "50%",
            transition: "background-color 0.2s ease",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.08)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent"
          }}
          aria-label="Close"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              fill="rgba(0, 0, 0, 0.54)"
            />
          </svg>
        </button>
      )}
      {children}
    </div>
  )
}

const SheetTitle = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h2
      style={{
        fontSize: "20px",
        fontWeight: 500,
        color: "rgba(0, 0, 0, 0.87)",
        margin: 0,
        letterSpacing: "0.15px",
        ...props.style
      }}
      {...props}
    >
      {children}
    </h2>
  )
}

const SheetDescription = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
  return (
    <p
      style={{
        fontSize: "14px",
        color: "rgba(0, 0, 0, 0.6)",
        margin: "8px 0 0 0",
        ...props.style
      }}
      {...props}
    >
      {children}
    </p>
  )
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        {...props}
      >
        {children}
      </button>
    )
  }
)

SheetTrigger.displayName = "SheetTrigger"

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger }


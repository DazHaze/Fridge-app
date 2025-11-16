import * as React from "react"

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = "md", style, ...props }, ref) => {
    const sizeMap = {
      sm: 16,
      md: 24,
      lg: 32,
    }

    const spinnerSize = sizeMap[size]

    const spinnerStyle: React.CSSProperties = {
      display: "inline-block",
      width: spinnerSize,
      height: spinnerSize,
      border: `2px solid rgba(98, 0, 238, 0.2)`,
      borderTop: `2px solid #6200ee`,
      borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
      ...style,
    }

    return (
      <div
        ref={ref}
        style={spinnerStyle}
        role="status"
        aria-label="Loading"
        {...props}
      />
    )
  }
)

Spinner.displayName = "Spinner"

export { Spinner }


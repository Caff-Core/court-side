import { Badge, type BadgeProps } from "@workspace/ui/components/reui/badge"

/**
 * A state badge led by a status dot. The dot takes the variant's text color
 * and is hidden from assistive tech; the label carries the meaning.
 */
export function DotBadge({
  variant,
  children,
}: {
  variant: BadgeProps["variant"]
  children: React.ReactNode
}) {
  return (
    <Badge variant={variant}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  )
}

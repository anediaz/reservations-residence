import './Skeleton.css'

interface SkeletonProps {
  width?: string
  height?: string
  className?: string
}

function Skeleton({ width = '100%', height = '1em', className }: SkeletonProps) {
  return <span className={['skeleton', className].filter(Boolean).join(' ')} style={{ width, height }} />
}

export default Skeleton

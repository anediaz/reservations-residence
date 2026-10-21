import Skeleton from './Skeleton'

interface TableSkeletonProps {
  columns: string[]
  rows?: number
  className?: string
}

function TableSkeleton({ columns, rows = 4, className }: TableSkeletonProps) {
  return (
    <div className="manager-table-scroll">
      <table className={className ? `manager-table ${className}` : 'manager-table'}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {columns.map((_, c) => (
                <td key={c}>
                  <Skeleton width="80%" height="14px" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TableSkeleton

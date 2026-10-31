$p = "apps\web\app\admin\books\book-ui.tsx"
$c = [System.IO.File]::ReadAllText((Resolve-Path $p))
$c = $c.Replace('import { createBook, updateBook } from "@/actions/catalog";' + "`n", 'import { useQueryClient } from "@tanstack/react-query";' + "`n" + 'import { api } from "@/lib/api-client";' + "`n")
$c = $c.Replace(@'
      action={async (form) =>
        createBook({
          title: form.get("title"),
          author: form.get("author") ?? "",
          courseIds: form.getAll("courseIds"),
          note: form.get("note") ?? "",
        })
      }
'@, @'
      action={async (form) => {
        await api.post("/admin/books", {
          title: form.get("title"),
          author: form.get("author") ?? "",
          courseIds: form.getAll("courseIds"),
          note: form.get("note") ?? "",
        });
        await queryClient.invalidateQueries({ queryKey: ["admin-books"] });
        return null;
      }}
'@)
$c = $c.Replace(@'
      action={async (form) =>
        updateBook({
          id: book.id,
          title: form.get("title"),
          author: form.get("author") ?? "",
          courseIds: form.getAll("courseIds"),
          note: form.get("note") ?? "",
        })
      }
'@, @'
      action={async (form) => {
        await api.patch(`/admin/books/${book.id}`, {
          title: form.get("title"),
          author: form.get("author") ?? "",
          courseIds: form.getAll("courseIds"),
          note: form.get("note") ?? "",
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["admin-books"] }),
          queryClient.invalidateQueries({ queryKey: ["admin-book", book.id] }),
        ]);
        return null;
      }}
'@)
$c = $c.Replace(@'
  preselect?: string;
}) {
  return (
'@, @'
  preselect?: string;
}) {
  const queryClient = useQueryClient();
  return (
'@)
$c = $c.Replace(@'
  courses: CourseOption[];
}) {
  return (
    <ActionForm
      className="space-y-3"
      submitLabel="Save book"
'@, @'
  courses: CourseOption[];
}) {
  const queryClient = useQueryClient();
  return (
    <ActionForm
      className="space-y-3"
      submitLabel="Save book"
'@)
[System.IO.File]::WriteAllText((Resolve-Path $p), $c)
Write-Output "done"

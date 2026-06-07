import { AdminSearch } from "@/components/admin/admin-search";

export const dynamic = "force-dynamic";

export default function AdminSearchPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Member Search</h1>
      <p className="mb-6 text-muted">
        Search for any member by first name, last name, or email address.
      </p>
      <AdminSearch />
    </>
  );
}

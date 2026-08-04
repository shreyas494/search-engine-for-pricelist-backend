import { useEffect, useState } from "react";


function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const [tyres, setTyres] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(20); // Items per page
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(""); // Debounced state
  const [brandFilter, setBrandFilter] = useState("");
  const [brands, setBrands] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(true);
  const [fields, setFields] = useState([]); // dynamically detected fields
  const [refreshingBrands, setRefreshingBrands] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState(null);


  // ✅ Debounce Search Term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // ✅ Fetch brands for dropdown
  useEffect(() => {
    fetch(`${API_URL}/api/brands`)
      .then((res) => res.json())
      .then((data) => setBrands(data))
      .catch((err) => console.error("Error fetching brands:", err));
  }, []);

  // ✅ Manual brand refresh (bypass cache)
  const handleRefreshBrands = () => {
    setRefreshingBrands(true);
    fetch(`${API_URL}/api/brands?refresh=true`)
      .then((res) => res.json())
      .then((data) => {
        setBrands(data);
        alert("Brands refreshed! ✅");
      })
      .catch((err) => {
        console.error("Error refreshing brands:", err);
        alert("Error refreshing brands ❌");
      })
      .finally(() => setRefreshingBrands(false));
  };

  // ✅ Delete all data for a specific brand
  const handleDeleteBrand = (brandToDelete) => {
    if (!brandToDelete) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete all data for brand "${brandToDelete}"?\n\nThis will permanently delete all product records for this brand.`
    );
    if (!confirmed) return;

    setDeletingBrand(brandToDelete);
    fetch(`${API_URL}/api/brands/${encodeURIComponent(brandToDelete)}`, {
      method: "DELETE",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete brand data");
        return res.json();
      })
      .then((data) => {
        alert(`✅ ${data.message} (${data.deletedCount} items deleted)`);
        if (brandFilter === brandToDelete) {
          setBrandFilter("");
        }
        // Refresh brand list bypassing cache
        return fetch(`${API_URL}/api/brands?refresh=true`);
      })
      .then((res) => res.json())
      .then((updatedBrands) => {
        setBrands(updatedBrands || []);
        setPage(1);
      })
      .catch((err) => {
        console.error("Error deleting brand:", err);
        alert(`❌ Error deleting brand data: ${err.message}`);
      })
      .finally(() => setDeletingBrand(null));
  };

  // ✅ Fetch tyres when brand/search/page changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (brandFilter) params.append("brand", brandFilter);
    if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
    params.append("page", page);
    params.append("limit", limit);

    fetch(`${API_URL}/api/tyres?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        // Handle paginated response
        const resultTyres = data.tyres || [];
        setTyres(resultTyres);
        setTotal(data.total || 0);
        setPages(data.pages || 1);

        // Determine all keys dynamically from current page or initial data
        if (resultTyres.length > 0) {
          const allFields = Array.from(
            new Set(resultTyres.flatMap((item) => Object.keys(item)))
          ).filter((f) => f !== "_id" && f !== "__v"); // ignore internal fields
          setFields(allFields);
        }
      })
      .catch((err) => console.error("Error fetching tyres:", err));
  }, [brandFilter, debouncedSearchTerm, page, limit]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [brandFilter, debouncedSearchTerm]);

  // ✅ Autocomplete suggestions (Now debounced via debouncedSearchTerm)
  useEffect(() => {
    if (!debouncedSearchTerm || !showAutocomplete) {
      setSuggestions([]);
      return;
    }
    const params = new URLSearchParams();
    if (brandFilter) params.append("brand", brandFilter);
    params.append("search", debouncedSearchTerm);

    fetch(`${API_URL}/api/tyres?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setSuggestions(data.tyres || []))
      .catch((err) => console.error("Error fetching suggestions:", err));
  }, [debouncedSearchTerm, brandFilter, showAutocomplete]);

  // ✅ Copy details dynamically
  const copyTyreDetails = (tyre) => {
    const text = fields
      .map((f) => `${f.charAt(0).toUpperCase() + f.slice(1)}: ${tyre[f]}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() =>
      alert("Product details copied to clipboard ✅")
    );
  };

  const handleSuggestionClick = (model) => {
    setSearchTerm(model);
    setDebouncedSearchTerm(model);
    setPage(1);
    setSuggestions([]);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Tyre Inventory</h1>

      {/* 🔎 Search + Brand Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative w-full md:w-1/2">
          <input
            type="text"
            placeholder="Search by model..."
            className="w-full p-2 pr-10 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search by model"
          />
          {searchTerm && (
            <button
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
              onClick={() => setSearchTerm("")}
              title="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {showAutocomplete && suggestions.length > 0 && (
            <ul className="absolute bg-white border w-full mt-1 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
              {suggestions.map((tyre) => (
                <li
                  key={tyre._id}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSuggestionClick(tyre.model)}
                >
                  {tyre.model}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-1/2">
          <select
            className="flex-grow p-2 border rounded-lg min-w-0"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefreshBrands}
            disabled={refreshingBrands}
            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0"
            title="Refresh brand list (bypass cache)"
          >
            {refreshingBrands ? "🔄" : "🔄"}
          </button>
          <button
            onClick={() => {
              setShowAutocomplete((s) => {
                const next = !s;
                if (!next) setSuggestions([]);
                return next;
              });
            }}
            className={`px-3 py-2 rounded-lg border flex-shrink-0 flex items-center justify-center gap-1 ${
              showAutocomplete ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
            title={showAutocomplete ? "Hide suggestions" : "Show suggestions"}
            aria-pressed={!showAutocomplete}
          >
            {showAutocomplete ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3C5 3 1.1 6.1 0 10c1.1 3.9 5 7 10 7s8.9-3.1 10-7c-1.1-3.9-5-7-10-7zM10 14a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
                <span className="hidden sm:inline">Suggestions On</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.94 2.94a.75.75 0 10-1.06 1.06l14.12 14.12a.75.75 0 101.06-1.06L2.94 2.94zM10 4c4.97 0 8.7 3.3 9.76 6-.5 1.63-1.96 3.26-3.8 4.45L7.55 6.29C8.74 5.17 9.35 4.57 10 4zM4.24 6.06C3.08 7.79 2.47 9.65 2 11c1.06 2.7 4.79 6 9.76 6 .6 0 1.2-.06 1.79-.18L4.24 6.06z" />
                </svg>
                <span className="hidden sm:inline">Suggestions Off</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 🏷️ Available Brands & Management */}
      <div className="bg-white p-4 shadow rounded-lg mb-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span>🏷️</span> Available Brands ({brands.length})
          </h2>
          <span className="text-xs text-gray-500">
            Click a brand to filter. Click 🗑️ to delete all data for that brand.
          </span>
        </div>

        {brands.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {brands.map((brand) => (
              <div
                key={brand}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  brandFilter === brand
                    ? "bg-blue-50 border-blue-500 text-blue-700 font-semibold shadow-sm"
                    : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <button
                  onClick={() => setBrandFilter(brandFilter === brand ? "" : brand)}
                  className="hover:underline text-left focus:outline-none"
                  title={brandFilter === brand ? "Click to clear filter" : `Filter by ${brand}`}
                >
                  {brand}
                </button>
                <button
                  onClick={() => handleDeleteBrand(brand)}
                  disabled={deletingBrand === brand}
                  className="ml-1 text-red-500 hover:text-red-700 hover:bg-red-100 p-1 rounded transition-colors disabled:opacity-50 flex items-center justify-center"
                  title={`Delete all data for brand "${brand}"`}
                  aria-label={`Delete all data for brand ${brand}`}
                >
                  {deletingBrand === brand ? (
                    <span className="text-xs animate-pulse text-red-600 font-bold">...</span>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No brands available in inventory.</p>
        )}
      </div>

      {/* 📋 Tyre Table */}
      <div className="overflow-x-auto bg-white shadow rounded-lg mb-4">
        <table className="min-w-full border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {fields.map((field) => (
                <th key={field} className="border p-2 text-left">
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </th>
              ))}
              {fields.length > 0 && (
                <th className="border p-2 text-left">Copy</th>
              )}
            </tr>
          </thead>
          <tbody>
            {tyres.length > 0 ? (
              tyres.map((tyre) => (
                <tr key={tyre._id} className="hover:bg-gray-50">
                  {fields.map((field) => (
                    <td key={field} className="border p-2">
                      {tyre[field] || "-"}
                    </td>
                  ))}
                  <td className="border p-2">
                    <button
                      className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      onClick={() => copyTyreDetails(tyre)}
                    >
                      Copy
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={fields.length + 1 || 1}
                  className="border p-2 text-center text-gray-500"
                >
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🔢 Pagination Controls */}
      {pages > 1 && (
        <div className="flex justify-between items-center bg-white p-4 shadow rounded-lg">
          <span className="text-gray-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} products
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className={`px-4 py-2 border rounded-lg ${page === 1 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
            >
              Previous
            </button>
            <span className="flex items-center px-4 py-2 border rounded-lg bg-gray-50 font-medium">
              Page {page} of {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
              className={`px-4 py-2 border rounded-lg ${page === pages ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

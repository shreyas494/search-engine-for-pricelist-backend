import { useEffect, useState } from "react";

function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const [tyres, setTyres] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(20); // Items per page
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [brands, setBrands] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(true);
  const [fields, setFields] = useState([]);
  const [refreshingBrands, setRefreshingBrands] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState(null);

  // 📌 Pinned items (Customer Quote Tray)
  const [pinnedItems, setPinnedItems] = useState(() => {
    try {
      const saved = localStorage.getItem("pinned_tyres");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Toast notification timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Save pinned items to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pinned_tyres", JSON.stringify(pinnedItems));
    } catch (e) {
      console.error("Error saving pinned items:", e);
    }
  }, [pinnedItems]);

  // Toggle Pin item in Quote Tray
  const togglePin = (tyre, e) => {
    if (e) e.stopPropagation();
    if (!tyre || !tyre._id) return;

    setPinnedItems((prev) => {
      const exists = prev.some((item) => item._id === tyre._id);
      if (exists) {
        setToastMessage(`Removed "${tyre.model || tyre.brand || 'Item'}" from pinned quote 📌`);
        return prev.filter((item) => item._id !== tyre._id);
      } else {
        setToastMessage(`Pinned "${tyre.model || tyre.brand || 'Item'}" to quote 📌`);
        return [tyre, ...prev];
      }
    });
  };

  const isPinned = (tyreId) => {
    return pinnedItems.some((item) => item._id === tyreId);
  };

  // Debounce Search Term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch brands for dropdown
  useEffect(() => {
    fetch(`${API_URL}/api/brands`)
      .then((res) => res.json())
      .then((data) => setBrands(data || []))
      .catch((err) => console.error("Error fetching brands:", err));
  }, [API_URL]);

  // Manual brand refresh (bypass cache)
  const handleRefreshBrands = () => {
    setRefreshingBrands(true);
    fetch(`${API_URL}/api/brands?refresh=true`)
      .then((res) => res.json())
      .then((data) => {
        setBrands(data || []);
        setToastMessage("Brand list refreshed! ✅");
      })
      .catch((err) => {
        console.error("Error refreshing brands:", err);
        setToastMessage("Error refreshing brands ❌");
      })
      .finally(() => setRefreshingBrands(false));
  };

  // Delete all data for a specific brand
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
        setToastMessage(`✅ ${data.message} (${data.deletedCount} items deleted)`);
        if (brandFilter === brandToDelete) {
          setBrandFilter("");
        }
        return fetch(`${API_URL}/api/brands?refresh=true`);
      })
      .then((res) => res.json())
      .then((updatedBrands) => {
        setBrands(updatedBrands || []);
        setPage(1);
      })
      .catch((err) => {
        console.error("Error deleting brand:", err);
        setToastMessage(`❌ Error deleting brand data: ${err.message}`);
      })
      .finally(() => setDeletingBrand(null));
  };

  // Fetch tyres when brand/search/page changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (brandFilter) params.append("brand", brandFilter);
    if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
    params.append("page", page);
    params.append("limit", limit);

    fetch(`${API_URL}/api/tyres?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const resultTyres = data.tyres || [];
        setTyres(resultTyres);
        setTotal(data.total || 0);
        setPages(data.pages || 1);

        if (resultTyres.length > 0) {
          const allFields = Array.from(
            new Set(resultTyres.flatMap((item) => Object.keys(item)))
          ).filter((f) => f !== "_id" && f !== "__v");
          setFields(allFields);
        }
      })
      .catch((err) => console.error("Error fetching tyres:", err));
  }, [brandFilter, debouncedSearchTerm, page, limit, API_URL]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [brandFilter, debouncedSearchTerm]);

  // Autocomplete suggestions
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
  }, [debouncedSearchTerm, brandFilter, showAutocomplete, API_URL]);

  // Copy details dynamically
  const copyTyreDetails = (tyre, e) => {
    if (e) e.stopPropagation();

    const keys = fields.length > 0 
      ? fields 
      : Object.keys(tyre).filter((f) => f !== "_id" && f !== "__v");

    const text = keys
      .map((f) => `${f.charAt(0).toUpperCase() + f.slice(1)}: ${tyre[f] ?? "-"}`)
      .join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setToastMessage("Product details copied to clipboard ✅");
    });
  };

  // Copy full customer quote for all pinned products
  const copyFullCustomerQuote = () => {
    if (pinnedItems.length === 0) return;

    let quoteText = `📦 PRODUCT PRICE QUOTE (${pinnedItems.length} Items)\n`;
    quoteText += `===========================================\n`;

    let totalMRP = 0;
    let totalDP = 0;

    pinnedItems.forEach((item, index) => {
      const brand = item.brand || "Brand";
      const model = item.model || "Model";
      const type = item.type ? ` | Type: ${item.type}` : "";
      const mrp = typeof item.mrp === "number" ? item.mrp : null;
      const dp = typeof item.dp === "number" ? item.dp : null;

      if (mrp) totalMRP += mrp;
      if (dp) totalDP += dp;

      quoteText += `${index + 1}. [${brand.toUpperCase()}] ${model}${type}\n`;
      if (dp !== null) quoteText += `   • Dealer Price (DP): ₹${dp.toLocaleString("en-IN")}\n`;
      if (mrp !== null) quoteText += `   • MRP: ₹${mrp.toLocaleString("en-IN")}\n`;
      quoteText += `-------------------------------------------\n`;
    });

    if (totalDP > 0 || totalMRP > 0) {
      quoteText += `📊 SUMMARY:\n`;
      if (totalDP > 0) quoteText += `Total DP: ₹${totalDP.toLocaleString("en-IN")}\n`;
      if (totalMRP > 0) quoteText += `Total MRP: ₹${totalMRP.toLocaleString("en-IN")}\n`;
      quoteText += `===========================================\n`;
    }

    quoteText += `Generated on ${new Date().toLocaleDateString()}`;

    navigator.clipboard.writeText(quoteText).then(() => {
      setToastMessage("Full customer quote copied to clipboard! 📋");
    });
  };

  const handleSuggestionClick = (tyre) => {
    if (typeof tyre === "string") {
      setSearchTerm(tyre);
      setDebouncedSearchTerm(tyre);
    } else {
      setSearchTerm(tyre.model || "");
      setDebouncedSearchTerm(tyre.model || "");
    }
    setPage(1);
    setSuggestions([]);
  };

  // Calculate pinned totals
  const totalPinnedDP = pinnedItems.reduce((acc, curr) => acc + (typeof curr.dp === "number" ? curr.dp : 0), 0);
  const totalPinnedMRP = pinnedItems.reduce((acc, curr) => acc + (typeof curr.mrp === "number" ? curr.mrp : 0), 0);

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen pb-28 font-sans text-gray-800">
      
      {/* 🔔 Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900/90 text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border border-gray-700 flex items-center gap-3 animate-bounce">
          <span className="text-base">ℹ️</span>
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* 🔝 Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
            🔍 Product Pricelist Search Engine
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Instant price lookups, multi-brand comparison, and customer quote builder.
          </p>
        </div>

        {/* 📌 Pinned Quote Header Button */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-all shadow-sm ${
            pinnedItems.length > 0
              ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 ring-2 ring-amber-400/30"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
          }`}
        >
          <span>📌 View Pinned Quote</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
            pinnedItems.length > 0 ? "bg-amber-700 text-white" : "bg-gray-200 text-gray-700"
          }`}>
            {pinnedItems.length}
          </span>
        </button>
      </div>

      {/* 🔎 Search + Brand Filter */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          
          {/* Search Input */}
          <div className="relative w-full md:w-1/2">
            <input
              type="text"
              placeholder="Search by model, specs, size..."
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search by model"
            />
            {searchTerm && (
              <button
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            {/* Suggestions Autocomplete */}
            {showAutocomplete && suggestions.length > 0 && (
              <ul className="absolute bg-white border border-gray-200 w-full mt-1 rounded-lg shadow-xl z-30 max-h-80 overflow-y-auto divide-y divide-gray-100">
                {suggestions.map((tyre) => (
                  <li
                    key={tyre._id}
                    className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs sm:text-sm flex justify-between items-center transition-colors"
                    onClick={() => handleSuggestionClick(tyre)}
                  >
                    <div>
                      <span className="font-semibold text-gray-900">{tyre.model}</span>
                      {tyre.brand && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {tyre.brand}
                        </span>
                      )}
                    </div>
                    {(tyre.dp || tyre.mrp) && (
                      <span className="text-xs font-bold text-blue-600">
                        ₹{(tyre.dp || tyre.mrp).toLocaleString("en-IN")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Brand Selector + Control Buttons */}
          <div className="flex gap-2 w-full md:w-1/2">
            <select
              className="flex-grow p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all min-w-0"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="">All Brands (Global Search)</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>

            <button
              onClick={handleRefreshBrands}
              disabled={refreshingBrands}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0 min-h-[40px] flex items-center justify-center transition-colors font-medium text-xs sm:text-sm"
              title="Refresh brand list (bypass cache)"
            >
              {refreshingBrands ? "🔄..." : "🔄 Refresh"}
            </button>

            <button
              onClick={() => {
                setShowAutocomplete((s) => {
                  const next = !s;
                  if (!next) setSuggestions([]);
                  return next;
                });
              }}
              className={`px-3 py-2 rounded-lg border flex-shrink-0 flex items-center justify-center gap-1.5 min-h-[40px] transition-colors ${
                showAutocomplete ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
              title={showAutocomplete ? "Hide suggestions" : "Show suggestions"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3C5 3 1.1 6.1 0 10c1.1 3.9 5 7 10 7s8.9-3.1 10-7c-1.1-3.9-5-7-10-7zM10 14a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              <span className="hidden sm:inline text-xs sm:text-sm">
                {showAutocomplete ? "Suggestions On" : "Suggestions Off"}
              </span>
            </button>
          </div>

        </div>

        {/* Quick Active Filter Pill */}
        {brandFilter && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-600 flex items-center gap-1.5">
              <span>Filter active:</span>
              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {brandFilter}
              </span>
            </span>
            <button
              onClick={() => setBrandFilter("")}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
            >
              ⚡ Switch to All Brands (Global Search)
            </button>
          </div>
        )}
      </div>

      {/* 📋 Products Data Table */}
      <div className="overflow-x-auto bg-white shadow-xs rounded-xl border border-gray-200 mb-6">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100/80">
            <tr>
              {/* Action Header */}
              <th className="border-b border-gray-200 p-3 text-center text-xs sm:text-sm font-semibold text-gray-700 w-28">
                Quote & Copy
              </th>
              {fields.map((field) => (
                <th key={field} className="border-b border-gray-200 p-3 text-left text-xs sm:text-sm font-semibold text-gray-700 capitalize">
                  {field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tyres.length > 0 ? (
              tyres.map((tyre) => {
                const pinned = isPinned(tyre._id);

                return (
                  <tr
                    key={tyre._id}
                    className={`transition-colors text-xs sm:text-sm ${
                      pinned
                        ? "bg-amber-50/70 hover:bg-amber-100/70"
                        : "hover:bg-blue-50/40"
                    }`}
                  >
                    {/* Actions Column */}
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all flex items-center gap-1 ${
                            pinned
                              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-2xs"
                              : "bg-amber-100/80 text-amber-800 hover:bg-amber-200 border border-amber-300"
                          }`}
                          onClick={(e) => togglePin(tyre, e)}
                          title={pinned ? "Remove from quote tray" : "Pin product to quote tray"}
                        >
                          <span>📌</span>
                          <span className="hidden sm:inline">{pinned ? "Pinned" : "Pin"}</span>
                        </button>

                        <button
                          className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors shadow-2xs"
                          onClick={(e) => copyTyreDetails(tyre, e)}
                          title="Copy details to clipboard"
                        >
                          Copy
                        </button>
                      </div>
                    </td>

                    {/* Dynamic Data Fields */}
                    {fields.map((field) => (
                      <td key={field} className="p-3 text-gray-800">
                        {field === "dp" || field === "mrp" ? (
                          typeof tyre[field] === "number" ? (
                            <span className="font-semibold text-gray-900">
                              ₹{tyre[field].toLocaleString("en-IN")}
                            </span>
                          ) : (
                            tyre[field] || "-"
                          )
                        ) : field === "brand" ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            {tyre[field]}
                          </span>
                        ) : (
                          tyre[field] || "-"
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={fields.length + 1 || 1}
                  className="p-8 text-center text-gray-500 text-xs sm:text-sm"
                >
                  No products found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🔢 Pagination Controls */}
      {pages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 shadow-xs rounded-xl border border-gray-200 gap-3 mb-8">
          <span className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} products
          </span>
          <div className="flex gap-2 w-full sm:w-auto justify-center">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm border rounded-lg font-medium transition-colors ${
                page === 1 ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "hover:bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              Previous
            </button>
            <span className="flex items-center px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-gray-50 font-bold text-gray-700">
              Page {page} of {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm border rounded-lg font-medium transition-colors ${
                page === pages ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "hover:bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 🏷️ Available Brands & Brand Management */}
      <div className="bg-white p-4 sm:p-5 shadow-xs rounded-xl border border-gray-200 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="p-1 bg-blue-100 text-blue-600 rounded-md text-sm">🏷️</span> 
              Brand Data Management ({brands.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Click a brand badge to filter inventory or click the red delete button to erase all data for that brand.
            </p>
          </div>
          {brandFilter && (
            <button
              onClick={() => setBrandFilter("")}
              className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg border border-blue-200 transition-colors font-semibold self-start sm:self-auto"
            >
              Clear Filter ({brandFilter})
            </button>
          )}
        </div>

        {brands.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {brands.map((brand) => {
              const isSelected = brandFilter === brand;
              const isDeleting = deletingBrand === brand;

              return (
                <div
                  key={brand}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-blue-50 border-blue-400 ring-2 ring-blue-400/20 shadow-xs"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100/80"
                  }`}
                >
                  <button
                    onClick={() => setBrandFilter(isSelected ? "" : brand)}
                    className="flex items-center gap-2 text-left focus:outline-none flex-grow min-w-0 mr-2 group py-1"
                    title={isSelected ? "Click to clear filter" : `Filter inventory by ${brand}`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? "bg-blue-600" : "bg-gray-400 group-hover:bg-gray-600"}`} />
                    <span className={`truncate font-semibold text-xs sm:text-sm ${isSelected ? "text-blue-900" : "text-gray-800"}`}>
                      {brand}
                    </span>
                  </button>

                  <button
                    onClick={() => handleDeleteBrand(brand)}
                    disabled={isDeleting}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[32px]"
                    title={`Permanently delete all data for brand "${brand}"`}
                  >
                    {isDeleting ? (
                      <span className="animate-pulse text-red-600 font-bold">Deleting...</span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 italic bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs sm:text-sm">
            No brands available in inventory.
          </div>
        )}
      </div>

      {/* 📌 Floating Bottom Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md border border-gray-700/80 flex items-center gap-4 transition-all">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-2.5 text-xs sm:text-sm font-bold hover:text-amber-400 transition-colors"
        >
          <span>📌 Pinned Quote Tray</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white">
            {pinnedItems.length}
          </span>
        </button>

        {pinnedItems.length > 0 && (
          <>
            <span className="h-4 w-px bg-gray-700" />
            <button
              onClick={copyFullCustomerQuote}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Copy Quote</span>
            </button>
          </>
        )}
      </div>

      {/* 🪟 Full Customer Quote Drawer (Modal) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-in fade-in slide-in-from-bottom duration-200">
            
            {/* Drawer Header */}
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <span>📌</span> Customer Quote Tray ({pinnedItems.length} Products)
              </h2>

              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 text-lg font-bold"
                title="Close drawer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-grow bg-gray-50">
              {pinnedItems.length > 0 ? (
                <div>
                  {/* Quote Toolbar Summary */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-amber-50 p-4 rounded-xl border border-amber-200 mb-4 gap-3">
                    <div>
                      <h3 className="font-bold text-amber-900 text-sm sm:text-base">
                        Quote Summary ({pinnedItems.length} Products)
                      </h3>
                      <div className="text-xs text-amber-800 mt-0.5 flex flex-wrap gap-x-4">
                        {totalPinnedDP > 0 && (
                          <span>Total Dealer Price (DP): <strong className="font-bold">₹{totalPinnedDP.toLocaleString("en-IN")}</strong></span>
                        )}
                        {totalPinnedMRP > 0 && (
                          <span>Total MRP: <strong className="font-bold">₹{totalPinnedMRP.toLocaleString("en-IN")}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={copyFullCustomerQuote}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>📋</span> Copy Full Quote Text
                      </button>

                      <button
                        onClick={() => setPinnedItems([])}
                        className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Pinned Products List */}
                  <div className="space-y-3">
                    {pinnedItems.map((item, index) => (
                      <div
                        key={item._id}
                        className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm truncate">
                                {item.model || "Product"}
                              </span>
                              {item.brand && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                                  {item.brand}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                              {item.type && <span>Type: {item.type}</span>}
                              {item.dp && <span className="font-semibold text-gray-800">DP: ₹{item.dp.toLocaleString("en-IN")}</span>}
                              {item.mrp && <span>MRP: ₹{item.mrp.toLocaleString("en-IN")}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => copyTyreDetails(item, e)}
                            className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                          >
                            Copy
                          </button>
                          <button
                            onClick={(e) => togglePin(item, e)}
                            className="px-2.5 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-semibold transition-colors"
                            title="Remove from quote"
                          >
                            Remove ❌
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300 p-6">
                  <span className="text-3xl block mb-2">📌</span>
                  <h4 className="font-bold text-gray-800 text-base mb-1">Your Quote Tray is Empty</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    While searching products or switching across different brands, click the <strong className="text-amber-600">📌 Pin</strong> button on any product row to save it here for quick comparison and customer quotes!
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;

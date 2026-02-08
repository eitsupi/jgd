# Registered .Call entries (suppress R CMD check NOTEs)
#' @useDynLib jgd, .registration = TRUE
NULL

.onLoad = function(libname, pkgname) {
  op = options()
  defaults = list(jgd.socket = NULL)
  toset = !(names(defaults) %in% names(op))
  if (any(toset)) options(defaults[toset])
  invisible()
}

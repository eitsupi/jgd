#' JSON Graphics Device
#'
#' Opens a graphics device that streams plot operations as JSON to an external
#' renderer (e.g. a VS Code extension) over a Unix domain socket.
#'
#' @param width Device width in inches (default 8).
#' @param height Device height in inches (default 6).
#' @param dpi Resolution in dots per inch (default 96).
#' @param socket Socket address for the rendering server. Supports URI formats
#'   (`tcp://host:port`, `unix:///path/to/socket`) or raw Unix socket paths.
#'   If `NULL` (default), use the `jgd.socket` R option, falling back to the `JGD_SOCKET`
#'   environment variable. If `JGD_SOCKET` environment variable is also unset,
#'   the device discovers the socket via the discovery file.
#' @section Debugging:
#' Set `options(jgd.debug = TRUE)` before opening the device to enable
#' frame-level diagnostic output on stderr (via `REprintf`).  This logs
#' details about `newPage`, `flush_frame`, and `poll_resize` events, which
#' is useful for diagnosing resize/replay issues.
#' @return Invisible `NULL`. The device is opened as a side effect.
#' @export
jgd = function(
  width = 8,
  height = 6,
  dpi = 96,
  socket = NULL
) {
  if (is.null(socket)) {
    socket = getOption("jgd.socket", default = {
      jgd_socket_env = Sys.getenv("JGD_SOCKET", unset = "")
      if (nzchar(jgd_socket_env)) jgd_socket_env else NULL
    })
  } else {
    stopifnot(is.character(socket), length(socket) == 1L)
  }

  .Call(C_jgd, as.double(width), as.double(height), as.double(dpi), socket)
  invisible()
}

#' Get server information
#'
#' Returns metadata about the server connected to the current jgd device,
#' or `NULL` if no server information is available.
#'
#' @return A named list with `server_name` (character), `protocol_version`
#'   (integer), `transport` (character), and `server_info` (named character
#'   vector), or `NULL`.
#' @export
jgd_server_info = function() {
  .Call(C_jgd_server_info)
}

#' Set extended graphics context (experimental)
#'
#' Sets extension fields that are included in every subsequent drawing
#' operation's graphics context (`gc.ext` in the JSON protocol).  This is
#' an experimental, low-level API for injecting renderer-specific properties
#' (e.g. blend modes, shadows, opacity) that go beyond R's standard graphics
#' parameters.
#'
#' @param json A single JSON string representing the extension object, or
#'   `NULL` to clear.  jgd does not validate the contents — the caller is
#'   responsible for producing valid JSON.  Packages built on top of jgd
#'   (using e.g. jsonlite) should provide user-friendly wrappers.
#' @return The previous ext JSON string (invisibly), or `NULL` if none was set.
#' @section Lifecycle:
#' **Experimental.** This API may change in future versions.
#' @export
jgd_ext = function(json = NULL) {
  if (!is.null(json)) {
    stopifnot(is.character(json), length(json) == 1L)
  }
  result = .Call(C_jgd_set_ext, json)
  if (is.character(result))
    stop("ext is not valid JSON: ", result, call. = FALSE)
  invisible()
}

#' Scoped extended graphics context (experimental)
#'
#' Temporarily sets extension fields for the duration of `expr`, then restores
#' the previous value.
#'
#' @inheritParams jgd_ext
#' @param expr Expression to evaluate with the extension active.
#' @return The result of evaluating `expr`.
#' @section Lifecycle:
#' **Experimental.** This API may change in future versions.
#' @export
with_jgd_ext = function(json, expr) {
  .Call(C_jgd_set_ext, json)
  on.exit(.Call(C_jgd_set_ext, NULL), add = TRUE)
  expr
}

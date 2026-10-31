# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:25.0.5_8-jre-jammy@sha256:659b528cca74a0edc5c25315ec5819f35bce40bbcec645c4c534987e4c6be7c1 AS bluemap-java

FROM eclipse-temurin:21.0.13_9-jre-jammy@sha256:1eac8b8fee11ca7d6725a48bc5d41992ed1561504ebae25490d2d062847e8269

COPY --from=bluemap-java /opt/java/openjdk /opt/java25

ARG CHUNKER_URL=https://github.com/HiveGamesOSS/Chunker/releases/download/1.21.0/chunker-cli-1.21.0.jar
ARG CHUNKER_SHA256=63148e587f5ee5a2ca7ebae1079b235c82ae4d1eff8f7a8a8a3398332513dda6
ARG PAPER_URL=https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar
ARG PAPER_SHA256=5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc
ARG DYNMAP_URL=https://dynmap.us/builds/dynmap/Dynmap-3.7-beta-8-spigot.jar
ARG DYNMAP_SHA256=87c6035c2cb73bf22fc34ca738cb21a2db89ab5f30bd1071cd8090802a1c78bc

ARG BLUEMAP_URL=https://github.com/BlueMap-Minecraft/BlueMap/releases/download/v5.29/bluemap-5.29-cli.jar
ARG BLUEMAP_SHA256=e830767fa6364b52b9310fb598508ebde7eec5ebe8360a989e240d991af89a3a

ARG CHUNKY_URL=https://hangarcdn.papermc.io/plugins/pop4959/Chunky/versions/1.4.40/PAPER/Chunky-Bukkit-1.4.40.jar
ARG CHUNKY_SHA256=2a5477fc80f71012e15ade1ce34dbeb836e17623b28db112492c0f1443c09721

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl python3 \
    && rm -rf /var/lib/apt/lists/* \
    && curl --fail --location --retry 5 --output /opt/chunker.jar "$CHUNKER_URL" \
    && curl --fail --location --retry 5 --header "User-Agent: pmc-website-map-generator/1.0 (local project)" --output /opt/paper.jar "$PAPER_URL" \
    && curl --fail --location --retry 5 --output /opt/dynmap.jar "$DYNMAP_URL" \
    && curl --fail --location --retry 5 --output /opt/bluemap.jar "$BLUEMAP_URL" \
    && curl --fail --location --retry 5 --output /opt/chunky.jar "$CHUNKY_URL" \
    && echo "$CHUNKER_SHA256  /opt/chunker.jar" | sha256sum --check \
    && echo "$PAPER_SHA256  /opt/paper.jar" | sha256sum --check \
    && echo "$DYNMAP_SHA256  /opt/dynmap.jar" | sha256sum --check \
    && echo "$BLUEMAP_SHA256  /opt/bluemap.jar" | sha256sum --check \
    && echo "$CHUNKY_SHA256  /opt/chunky.jar" | sha256sum --check \
    && useradd --create-home --uid 10001 mapgen \
    && mkdir -p /input /work /output \
    && chown -R mapgen:mapgen /input /work /output

COPY --chmod=755 render-map.sh /usr/local/bin/render-map
COPY --chmod=644 render-log.sh /usr/local/lib/render-log.sh
COPY --chmod=644 map-storage.sh /usr/local/lib/map-storage.sh
COPY --chmod=755 extract_archive.py /usr/local/bin/extract_archive.py
COPY --chmod=755 update_catalog.py /usr/local/bin/update_catalog.py
COPY --chmod=644 current_snapshot.py /usr/local/bin/current_snapshot.py
COPY --chmod=755 render-bluemap.sh /usr/local/bin/render-bluemap
COPY --chmod=755 chunky-region-bounds.py /usr/local/bin/chunky-region-bounds.py
COPY --chmod=644 bluemap-embed.js bluemap-embed.css /usr/local/share/bluemap/
RUN chmod 755 /usr/local/share/bluemap

USER mapgen
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/render-map"]

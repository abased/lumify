package io.lumify.core.model.detectedObjects;

import com.altamiracorp.bigtable.model.RowKey;
import io.lumify.core.util.RowKeyHelper;
import org.apache.commons.lang.StringUtils;

public class DetectedObjectRowKey extends RowKey {
    public DetectedObjectRowKey(String rowKey) {
        super(rowKey);
    }

    public DetectedObjectRowKey(Object vertexId, Object x1, Object y1, Object x2, Object y2) {
        this(buildKey(vertexId, x1, y1, x2, y2));
    }

    public DetectedObjectRowKey(Object vertexId, Object x1, Object y1, Object x2, Object y2, Object uniqueId) {
        this(buildKey(vertexId, x1, y1, x2, y2, uniqueId));
    }

    private static String buildKey(Object vertexId, Object x1, Object y1, Object x2, Object y2) {
        return vertexId
                + ":"
                + StringUtils.leftPad(x1.toString(), RowKeyHelper.OFFSET_WIDTH, '0')
                + ":"
                + StringUtils.leftPad(y1.toString(), RowKeyHelper.OFFSET_WIDTH, '0')
                + ":"
                + StringUtils.leftPad(x2.toString(), RowKeyHelper.OFFSET_WIDTH, '0')
                + ":"
                + StringUtils.leftPad(y2.toString(), RowKeyHelper.OFFSET_WIDTH, '0');
    }

    private static String buildKey(Object vertexId, Object x1, Object y1, Object x2, Object y2, Object uniqueId) {
        return vertexId
                + ":"
                + StringUtils.leftPad(x1.toString(), RowKeyHelper.OFFSET_WIDTH, '0')
                + ":"
                + StringUtils.leftPad(y1.toString(), RowKeyHelper.OFFSET_WIDTH, '0')
                + ":"
                + StringUtils.leftPad(x2.toString(), RowKeyHelper.OFFSET_WIDTH, '0')
                + ":"
                + StringUtils.leftPad(y2.toString(), RowKeyHelper.OFFSET_WIDTH, '0')
                + ":"
                + uniqueId;
    }

    public String getArtifactId() {
        String[] keyElements = this.toString().split(":");
        return keyElements.length == 6 ? keyElements[keyElements.length - 6] : keyElements[keyElements.length - 5];
    }

    public String getEdgeId () {
        String[] keyElements = this.toString().split(":");
        return keyElements[keyElements.length - 1];
    }
}
